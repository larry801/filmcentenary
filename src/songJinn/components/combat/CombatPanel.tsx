import React from "react";
import { Country, SJPlayer, SongJinnGame } from "../../constant/general";
import { Ctx, LogEntry, PlayerID } from "boardgame.io";
import Paper from "@mui/material/Paper";
import { CombatHeader } from "./CombatHeader";
import { ForceCard } from "./ForceCard";
import { CombatActions } from "./CombatActions";
import { actualStage } from "../../game/util";
import { sjCardById } from "../../util";
import styles from "../../styles/combat.module.css";
import "../../styles/variables.css";
import "../../styles/typography.css";

export interface ICombatInfo {
  G: SongJinnGame;
  pid: PlayerID | null;
  ctx: Ctx;
  moves: Record<string, (...args: any[]) => void>;
  isActive: boolean;
  log: LogEntry[];
}

export const CombatPanel = ({ G, ctx, pid, moves, isActive }: ICombatInfo) => {
  const s = G.combat;

  React.useEffect(() => {
    if (isActive && actualStage(G, ctx) === 'showCC') {
      if (pid !== null) {
        moves.showCC(G.player[pid as SJPlayer].combatCard);
      }
    }
  }, [isActive, ctx.activePlayers]);

  React.useEffect(() => {
    if (isActive && actualStage(G, ctx) === 'combatCard') {
      if (pid !== null) {
        if (G.player[pid as SJPlayer].hand.filter((c: string) => sjCardById(c).combat).length === 0) {
          moves.combatCard([]);
        }
      }
    }
  }, [isActive, ctx.activePlayers]);

  if (!s.ongoing) {
    return <></>;
  }

  const pub = pid === SJPlayer.P1 ? G.song : pid === SJPlayer.P2 ? G.jinn : G.song;
  
  const songTroopsInCombat = G.song.troops.filter((t: any) => 
    (s.region !== null && t.p === s.region) || (s.city !== null && t.c === s.city)
  );
  
  const jinnTroopsInCombat = G.jinn.troops.filter((t: any) => 
    (s.region !== null && t.p === s.region) || (s.city !== null && t.c === s.city)
  );

  const songIsActive = isActive && pid === SJPlayer.P1;
  const jinnIsActive = isActive && pid === SJPlayer.P2;

  return (
    <Paper className={`${styles.combatPanel} ${s.ongoing ? styles.active : styles.inactive}`}>
      <CombatHeader 
        type={s.type}
        phase={s.phase}
        region={s.region}
        city={s.city}
        ongoing={s.ongoing}
      />
      
      <div className={styles.forcesContainer}>
        <ForceCard
          G={G}
          country={Country.SONG}
          troops={songTroopsInCombat}
          combatCards={s.song.combatCard}
          dices={G.song.dices}
          damageLeft={s.song.damageLeft}
          isActive={songIsActive}
        />
        
        <ForceCard
          G={G}
          country={Country.JINN}
          troops={jinnTroopsInCombat}
          combatCards={s.jinn.combatCard}
          dices={G.jinn.dices}
          damageLeft={s.jinn.damageLeft}
          isActive={jinnIsActive}
        />
      </div>
      
      <CombatActions
        pid={pid}
        isActive={isActive}
        G={G}
        ctx={ctx}
        moves={moves}
        pub={pub}
      />
    </Paper>
  );
};
