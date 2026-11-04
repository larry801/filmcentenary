import React from "react";
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
    
    return (
        <section className="vq-panel vq-hand">
            <div className="vq-panel-heading">
                <h2>手牌 <span style={{fontWeight: 400}}>· {hand.length} 张</span></h2>
                <Stack direction="row" spacing={0.5}>
                    {ps?.treasures.map((treasure: number, index: number) => 
                        <Button key={index} size="small" variant="outlined"
                            disabled={!canAct || !ps.cardPlayed || ps.treasurePlayed} 
                            onClick={() => moves.playTreasure({index})}>宝藏 {treasure} CP</Button>
                    )}
                    {isDesktop && <Button size="small" aria-expanded={handExpanded} aria-controls={`${panelID}-cards`}
                        onClick={() => setHandExpanded(!handExpanded)}>{handExpanded ? "收起手牌" : "展开手牌"}</Button>}
                </Stack>
            </div>
            <div id={`${panelID}-cards`} hidden={isDesktop && !handExpanded}>
                {hand.length === 0 && <Typography variant="body2" color="text.secondary">{me ? "暂无手牌。" : "旁观模式仅展示公开牌数。"}</Typography>}
                <div className="vq-card-tray">
                    {hand.map((id: string) => {
                        const card = cardById(id);
                        return <button key={id} className="vq-card" aria-label={`查看卡牌 ${card.name} · ${card.cp} CP`} 
                            onClick={() => {
                                setSelectedCard(id); 
                                setEventTarget(""); 
                                setHolyLeagueEventTarget(""); 
                                setMenendezEventTarget(""); 
                                setPolishElectionBids({}); 
                                setStaffordSelection({power: ""});
                            }}>
                            <CardArt def={card} className="vq-card-art" lazy/>
                            <small>{card.kind === "home" ? "本国牌" : card.kind === "event" ? "事件牌" : "行动牌"}<span className="vq-card-cp">{card.cp} CP</span></small>
                            <strong>{card.name}</strong><small>查看详情 ↗</small>
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
