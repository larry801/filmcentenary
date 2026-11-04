import React from "react";
import { Country, SJPlayer } from "../../constant/general";
import { Ctx } from "boardgame.io";
import { actualStage } from "../../game/util";
import styles from "../../styles/combat.module.css";

interface CombatActionsProps {
  pid: string | null;
  isActive: boolean;
  G: any;
  ctx: Ctx;
  moves: Record<string, (...args: any[]) => void>;
  pub: any;
}

export const CombatActions = ({ pid, isActive, G, ctx, moves, pub }: CombatActionsProps) => {
  if (pid === null) return <></>;
  
  const stage = actualStage(G, ctx);
  const [count, setCount] = React.useState(5);
  
  const adjustDice = (n: number) => {
    const newDice = count + n;
    if (newDice <= 1) {
      setCount(1);
    } else if (newDice >= 30) {
      setCount(30);
    } else {
      setCount(newDice);
    }
  };

  return (
    <div className={styles.combatActions}>
      {isActive && stage === 'rollDice' && (
        <div style={{ display: 'flex', gap: 'var(--space-xs)', alignItems: 'center', flexWrap: 'wrap' }}>
          <button className={styles.actionButton} onClick={() => adjustDice(-5)}>-5</button>
          <button className={styles.actionButton} onClick={() => adjustDice(-1)}>-1</button>
          <button 
            className={`${styles.actionButton} ${styles.primary}`}
            onClick={() => moves.rollDices({ count: count, idx: pub.dices?.length || 0 })}
          >
            掷{count}个骰子
          </button>
          <button className={styles.actionButton} onClick={() => adjustDice(1)}>+1</button>
          <button className={styles.actionButton} onClick={() => adjustDice(5)}>+5</button>
        </div>
      )}
      
      {isActive && stage === 'combatCard' && (
        <button 
          className={`${styles.actionButton} ${styles.primary}`}
          disabled
        >
          请在手牌选择战斗牌
        </button>
      )}
      
      {isActive && stage === 'showCC' && (
        <button 
          className={`${styles.actionButton} ${styles.primary}`}
          onClick={() => moves.showCC(G.player[pid as SJPlayer].combatCard)}
        >
          展示战斗牌
        </button>
      )}
      
      {isActive && stage === 'confirmRespond' && (
        <button 
          className={`${styles.actionButton} ${styles.secondary}`}
          disabled
        >
          请在对话框确认
        </button>
      )}
      
      {isActive && stage === 'retreat' && (
        <button 
          className={`${styles.actionButton} ${styles.danger}`}
          disabled
        >
          请在对话框选择撤退目标
        </button>
      )}
      
      {isActive && stage === 'takeDamage' && (
        <button 
          className={`${styles.actionButton} ${styles.danger}`}
          disabled
        >
          请在对话框分配伤害
        </button>
      )}
    </div>
  );
};
